"""
Master data seed script.
Seeds ALL permissions (100+), ALL 15 roles (REQUESTOR through SUPPLIER_USER),
Incoterms, UOMs, and role-permission mappings.
Idempotent (ON CONFLICT DO NOTHING). Safe to run at startup.
"""
from __future__ import annotations

import asyncio
from datetime import date
import logging
import os
import sys
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
from app.core.constants import PermissionCode

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ALL 15 roles per SPEC_04 Section 9.2
ROLES = [
    # Internal roles
    {"code": "REQUESTOR", "name": "Requestor", "is_system_role": True, "is_supplier_role": False},
    {"code": "APPROVER", "name": "Approver", "is_system_role": True, "is_supplier_role": False},
    {"code": "BUYER", "name": "Buyer", "is_system_role": True, "is_supplier_role": False},
    {"code": "PROCUREMENT_OFFICER", "name": "Procurement Officer", "is_system_role": True, "is_supplier_role": False},
    {"code": "PROCUREMENT_MANAGER", "name": "Procurement Manager", "is_system_role": True, "is_supplier_role": False},
    {"code": "PROCUREMENT_HEAD", "name": "Procurement Head", "is_system_role": True, "is_supplier_role": False},
    {"code": "FINANCE_CONTROLLER", "name": "Finance Controller", "is_system_role": True, "is_supplier_role": False},
    {"code": "COMPLIANCE_OFFICER", "name": "Compliance Officer", "is_system_role": True, "is_supplier_role": False},
    {"code": "VENDOR_ADMIN", "name": "Vendor Admin", "is_system_role": True, "is_supplier_role": False},
    {"code": "PROCUREMENT_ADMIN", "name": "Procurement Admin", "is_system_role": True, "is_supplier_role": False},
    {"code": "SOURCING_MANAGER", "name": "Sourcing Manager", "is_system_role": True, "is_supplier_role": False},
    {"code": "CFO", "name": "CFO", "is_system_role": True, "is_supplier_role": False},
    # Supplier roles
    {"code": "SUPPLIER", "name": "Supplier", "is_system_role": True, "is_supplier_role": True},
    {"code": "SUPPLIER_ADMIN", "name": "Supplier Admin", "is_system_role": True, "is_supplier_role": True},
    {"code": "SUPPLIER_USER", "name": "Supplier User", "is_system_role": True, "is_supplier_role": True},
    {"code": "SUPERADMIN", "name": "Super Admin", "is_system_role": True, "is_supplier_role": False},
    {"code": "ORG_ADMIN", "name": "Organization Admin", "is_system_role": True, "is_supplier_role": False},
]

# All 100+ permissions from PermissionCode
PERMISSIONS = [
    (code_val, name, module)
    for attr in dir(PermissionCode)
    if not attr.startswith("_") and isinstance((code_val := getattr(PermissionCode, attr)), str)
    for name, module in [(
        attr.replace("_", " ").title(),
        code_val.split(".")[0] if "." in code_val else "system"
    )]
]

INCOTERMS = [
    {"code": "EXW", "name": "Ex Works", "edition_year": 2020, "risk_transfer_point": "Seller premises"},
    {"code": "FCA", "name": "Free Carrier", "edition_year": 2020, "risk_transfer_point": "Named carrier"},
    {"code": "CPT", "name": "Carriage Paid To", "edition_year": 2020, "risk_transfer_point": "First carrier"},
    {"code": "CIP", "name": "Carriage and Insurance Paid To", "edition_year": 2020, "risk_transfer_point": "First carrier"},
    {"code": "DAP", "name": "Delivered at Place", "edition_year": 2020, "risk_transfer_point": "Named place"},
    {"code": "DPU", "name": "Delivered at Place Unloaded", "edition_year": 2020, "risk_transfer_point": "Unloaded at destination"},
    {"code": "DDP", "name": "Delivered Duty Paid", "edition_year": 2020, "risk_transfer_point": "Destination cleared for import"},
    {"code": "FAS", "name": "Free Alongside Ship", "edition_year": 2020, "risk_transfer_point": "Alongside ship at port"},
    {"code": "FOB", "name": "Free On Board", "edition_year": 2020, "risk_transfer_point": "On board vessel"},
    {"code": "CFR", "name": "Cost and Freight", "edition_year": 2020, "risk_transfer_point": "On board vessel"},
    {"code": "CIF", "name": "Cost, Insurance and Freight", "edition_year": 2020, "risk_transfer_point": "On board vessel"},
]

DEFAULT_UOMS = [
    {"code": "EA", "name": "Each"},
    {"code": "KG", "name": "Kilogram"},
    {"code": "L", "name": "Liter"},
    {"code": "M", "name": "Meter"},
    {"code": "BOX", "name": "Box"},
    {"code": "SET", "name": "Set"},
    {"code": "TON", "name": "Metric Ton"},
    {"code": "SQM", "name": "Square Meter"},
    {"code": "CUM", "name": "Cubic Meter"},
    {"code": "PKT", "name": "Packet"},
]

DEFAULT_CURRENCIES = [
    {"code": "INR", "name": "Indian Rupee", "symbol": "₹", "exchange_rate_to_base": 1.0, "is_base_currency": True},
    {"code": "USD", "name": "US Dollar", "symbol": "$", "exchange_rate_to_base": 83.50, "is_base_currency": False},
    {"code": "EUR", "name": "Euro", "symbol": "€", "exchange_rate_to_base": 90.25, "is_base_currency": False},
    {"code": "GBP", "name": "British Pound", "symbol": "£", "exchange_rate_to_base": 106.10, "is_base_currency": False},
    {"code": "SGD", "name": "Singapore Dollar", "symbol": "S$", "exchange_rate_to_base": 62.40, "is_base_currency": False},
    {"code": "AED", "name": "UAE Dirham", "symbol": "د.إ", "exchange_rate_to_base": 22.73, "is_base_currency": False},
    {"code": "JPY", "name": "Japanese Yen", "symbol": "¥", "exchange_rate_to_base": 0.55, "is_base_currency": False},
]

DEFAULT_PAYMENT_TERMS = [
    {"code": "NET30", "name": "Net 30 Days", "payment_days": 30, "net_days": 30, "advance_percentage": 0.0, "retention_percentage": 0.0, "discount_percentage": 0.0, "discount_days": 0, "description": "Payment due within 30 days of invoice date"},
    {"code": "NET60", "name": "Net 60 Days", "payment_days": 60, "net_days": 60, "advance_percentage": 0.0, "retention_percentage": 0.0, "discount_percentage": 0.0, "discount_days": 0, "description": "Payment due within 60 days of invoice date"},
    {"code": "NET90", "name": "Net 90 Days", "payment_days": 90, "net_days": 90, "advance_percentage": 0.0, "retention_percentage": 0.0, "discount_percentage": 0.0, "discount_days": 0, "description": "Payment due within 90 days of invoice date"},
    {"code": "2_10_NET30", "name": "2% 10 Net 30", "payment_days": 30, "net_days": 30, "advance_percentage": 0.0, "retention_percentage": 0.0, "discount_percentage": 2.0, "discount_days": 10, "description": "2% discount if paid within 10 days, net due in 30 days"},
    {"code": "IMMEDIATE", "name": "Immediate / Due Upon Receipt", "payment_days": 0, "net_days": 0, "advance_percentage": 0.0, "retention_percentage": 0.0, "discount_percentage": 0.0, "discount_days": 0, "description": "Payment due immediately upon receipt"},
    {"code": "ADVANCE_50", "name": "50% Advance, Balance on Delivery", "payment_days": 30, "net_days": 30, "advance_percentage": 50.0, "retention_percentage": 0.0, "discount_percentage": 0.0, "discount_days": 0, "description": "50% advance payment required, remaining 50% net 30"},
    {"code": "RETENTION_10", "name": "Net 30 with 10% Retention", "payment_days": 30, "net_days": 30, "advance_percentage": 0.0, "retention_percentage": 10.0, "discount_percentage": 0.0, "discount_days": 0, "description": "Net 30 days with 10% retention withheld until final signoff"},
]

DEFAULT_TAX_CODES = [
    {"code": "GST_0", "name": "GST 0% (Exempt / Nil Rated)", "tax_type": "GST", "rate": 0.0, "hsn_chapter": "01"},
    {"code": "GST_5", "name": "GST 5% (Essential Goods / Transport)", "tax_type": "GST", "rate": 5.0, "hsn_chapter": "10"},
    {"code": "GST_12", "name": "GST 12% (Standard Concession)", "tax_type": "GST", "rate": 12.0, "hsn_chapter": "84"},
    {"code": "GST_18", "name": "GST 18% (Standard Rate for Goods & Services)", "tax_type": "GST", "rate": 18.0, "hsn_chapter": "85"},
    {"code": "GST_28", "name": "GST 28% (Luxury & Sin Goods)", "tax_type": "GST", "rate": 28.0, "hsn_chapter": "87"},
    {"code": "TDS_194C", "name": "TDS u/s 194C (Contractors / Sub-contractors 2%)", "tax_type": "TDS", "rate": 2.0, "hsn_chapter": "99"},
    {"code": "TDS_194J", "name": "TDS u/s 194J (Professional / Technical Fees 10%)", "tax_type": "TDS", "rate": 10.0, "hsn_chapter": "99"},
    {"code": "TDS_194Q", "name": "TDS u/s 194Q (Purchase of Goods 0.1%)", "tax_type": "TDS", "rate": 0.1, "hsn_chapter": "99"},
    {"code": "CESS_12", "name": "Compensation Cess 12%", "tax_type": "CESS", "rate": 12.0, "hsn_chapter": "87"},
]

DEFAULT_DELIVERY_LOCATIONS = [
    {
        "code": "LOC-HQ-MUM",
        "name": "Corporate HQ & Server Room",
        "address_line1": "Tower 4, 12th Floor, Bandra Kurla Complex",
        "city": "Mumbai",
        "state": "Maharashtra",
        "postal_code": "400051",
        "country_code": "IN",
    },
    {
        "code": "LOC-DC-BLR",
        "name": "Bengaluru Data Center & Technology Hub",
        "address_line1": "Plot 24, Electronics City Phase 1",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560100",
        "country_code": "IN",
    },
    {
        "code": "LOC-WH-DEL",
        "name": "Northern Regional Warehouse & Logistics",
        "address_line1": "Udyog Vihar Phase 4, Sector 18",
        "city": "Gurugram",
        "state": "Haryana",
        "postal_code": "122015",
        "country_code": "IN",
    },
    {
        "code": "LOC-PLANT-CHE",
        "name": "Chennai Manufacturing & Assembly Plant",
        "address_line1": "SIPCOT Industrial Park, Sriperumbudur",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "postal_code": "602105",
        "country_code": "IN",
    },
    {
        "code": "LOC-WH-HYD",
        "name": "Hyderabad Distribution Center",
        "address_line1": "Hardware Park, Shamshabad",
        "city": "Hyderabad",
        "state": "Telangana",
        "postal_code": "501218",
        "country_code": "IN",
    },
]

DEFAULT_HOLIDAYS = [
    {"name": "Republic Day", "holiday_date": date(2026, 1, 26)},
    {"name": "Holi", "holiday_date": date(2026, 3, 4)},
    {"name": "Eid al-Fitr", "holiday_date": date(2026, 3, 20)},
    {"name": "Good Friday", "holiday_date": date(2026, 4, 3)},
    {"name": "Independence Day", "holiday_date": date(2026, 8, 15)},
    {"name": "Mahatma Gandhi Jayanti", "holiday_date": date(2026, 10, 2)},
    {"name": "Dussehra", "holiday_date": date(2026, 10, 20)},
    {"name": "Diwali", "holiday_date": date(2026, 11, 8)},
    {"name": "Christmas", "holiday_date": date(2026, 12, 25)},
]

DEFAULT_CATEGORIES = [
    {"code": "CAT-IT", "name": "Information Technology", "parent_code": None, "level": 1},
    {"code": "CAT-HW", "name": "Hardware & Compute", "parent_code": "CAT-IT", "level": 2},
    {"code": "CAT-SW", "name": "Software & SaaS Licenses", "parent_code": "CAT-IT", "level": 2},
    {"code": "CAT-CLOUD", "name": "Cloud & Network Services", "parent_code": "CAT-IT", "level": 2},
    {"code": "CAT-NET", "name": "Networking & Telecom", "parent_code": "CAT-IT", "level": 2},
    {"code": "CAT-FAC", "name": "Facilities & Office Supplies", "parent_code": None, "level": 1},
    {"code": "CAT-FURN", "name": "Furniture & Workstations", "parent_code": "CAT-FAC", "level": 2},
    {"code": "CAT-ELEC", "name": "Electrical & Maintenance", "parent_code": "CAT-FAC", "level": 2},
    {"code": "CAT-LOG", "name": "Logistics & Transportation", "parent_code": None, "level": 1},
]

# Role-permission mappings: role_code -> list of permission codes granted
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "REQUESTOR": [
        PermissionCode.PR_CREATE, PermissionCode.PR_VIEW_OWN, PermissionCode.PR_SUBMIT,
        PermissionCode.PR_CANCEL, PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_OWN,
        PermissionCode.NOTIFICATION_VIEW_OWN, PermissionCode.ANALYTICS_VIEW_DASHBOARD,
        PermissionCode.MASTER_VIEW,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_OWN,
    ],
    "APPROVER": [
        PermissionCode.PR_VIEW_BU, PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT,
        PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.DOCUMENT_VIEW_OWN, PermissionCode.NOTIFICATION_VIEW_OWN,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.WORKFLOW_VIEW,
        PermissionCode.MASTER_VIEW,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_TEAM, PermissionCode.TICKET_VIEW_ALL,
        PermissionCode.TICKET_ASSIGN, PermissionCode.TICKET_RESOLVE, PermissionCode.TICKET_REOPEN,
    ],
    "PROCUREMENT_OFFICER": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT,
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE,
        PermissionCode.CONTRACT_CREATE, PermissionCode.CONTRACT_VIEW_ALL, PermissionCode.CONTRACT_VIEW_OWN,
        PermissionCode.PO_CREATE, PermissionCode.PO_VIEW_ALL, PermissionCode.PO_VIEW_OWN, PermissionCode.PO_APPROVE, PermissionCode.PO_AMEND, PermissionCode.PO_CANCEL, PermissionCode.PO_CLOSE,
        PermissionCode.GRN_CREATE, PermissionCode.GRN_VIEW_ALL, PermissionCode.GRN_VIEW_OWN, PermissionCode.GRN_APPROVE,
        PermissionCode.INVOICE_VIEW_ALL, PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_MATCH, PermissionCode.INVOICE_APPROVE,
        PermissionCode.PAYMENT_VIEW_ALL, PermissionCode.PAYMENT_VIEW_OWN, PermissionCode.PAYMENT_INITIATE,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.NOTIFICATION_VIEW_OWN, PermissionCode.ANALYTICS_VIEW_DASHBOARD,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_CANCEL,
        PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
        PermissionCode.MASTER_VIEW,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_TEAM, PermissionCode.TICKET_VIEW_ALL,
        PermissionCode.TICKET_ASSIGN, PermissionCode.TICKET_RESOLVE, PermissionCode.TICKET_REOPEN,
        PermissionCode.TICKET_ADD_INTERNAL, PermissionCode.TICKET_LINK,
    ],
    "BUYER": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT,
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE,
        PermissionCode.CONTRACT_CREATE, PermissionCode.CONTRACT_VIEW_ALL, PermissionCode.CONTRACT_VIEW_OWN,
        PermissionCode.PO_CREATE, PermissionCode.PO_VIEW_ALL, PermissionCode.PO_VIEW_OWN, PermissionCode.PO_APPROVE, PermissionCode.PO_AMEND, PermissionCode.PO_CANCEL, PermissionCode.PO_CLOSE,
        PermissionCode.GRN_CREATE, PermissionCode.GRN_VIEW_ALL, PermissionCode.GRN_VIEW_OWN, PermissionCode.GRN_APPROVE,
        PermissionCode.INVOICE_VIEW_ALL, PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_MATCH, PermissionCode.INVOICE_APPROVE,
        PermissionCode.PAYMENT_VIEW_ALL, PermissionCode.PAYMENT_VIEW_OWN, PermissionCode.PAYMENT_INITIATE,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.NOTIFICATION_VIEW_OWN, PermissionCode.ANALYTICS_VIEW_DASHBOARD,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_CANCEL,
        PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
        PermissionCode.MASTER_VIEW,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_TEAM, PermissionCode.TICKET_VIEW_ALL,
        PermissionCode.TICKET_ASSIGN, PermissionCode.TICKET_RESOLVE, PermissionCode.TICKET_REOPEN,
        PermissionCode.TICKET_ADD_INTERNAL, PermissionCode.TICKET_LINK,
    ],
    "PROCUREMENT_MANAGER": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT,
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.RFQ_AMEND, PermissionCode.RFQ_CANCEL,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN, PermissionCode.BID_EVALUATE,
        PermissionCode.EVAL_VIEW, PermissionCode.EVAL_SCORE, PermissionCode.EVAL_SUBMIT_RECOMMENDATION,
        PermissionCode.AWARD_RECOMMEND, PermissionCode.AWARD_APPROVE,
        PermissionCode.CONTRACT_CREATE, PermissionCode.CONTRACT_VIEW_ALL, PermissionCode.CONTRACT_ACTIVATE,
        PermissionCode.PO_CREATE, PermissionCode.PO_VIEW_ALL, PermissionCode.PO_VIEW_OWN, PermissionCode.PO_APPROVE, PermissionCode.PO_AMEND, PermissionCode.PO_CANCEL, PermissionCode.PO_CLOSE,
        PermissionCode.GRN_CREATE, PermissionCode.GRN_VIEW_ALL, PermissionCode.GRN_VIEW_OWN, PermissionCode.GRN_APPROVE,
        PermissionCode.INVOICE_VIEW_ALL, PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_MATCH, PermissionCode.INVOICE_APPROVE,
        PermissionCode.PAYMENT_VIEW_ALL, PermissionCode.PAYMENT_VIEW_OWN, PermissionCode.PAYMENT_INITIATE, PermissionCode.PAYMENT_APPROVE,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE, PermissionCode.VENDOR_QUALIFY,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.RULES_VIEW,
        PermissionCode.USER_VIEW_ALL, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.MASTER_VIEW,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_CANCEL,
        PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_ALL, PermissionCode.TICKET_ASSIGN,
        PermissionCode.TICKET_RESOLVE, PermissionCode.TICKET_CLOSE, PermissionCode.TICKET_REOPEN,
        PermissionCode.TICKET_ESCALATE, PermissionCode.TICKET_ADD_INTERNAL, PermissionCode.TICKET_LINK,
        PermissionCode.TICKET_EXPORT,
    ],
    "PROCUREMENT_HEAD": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT,
        PermissionCode.PR_VIEW_BU, PermissionCode.PR_SUBMIT,
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.RFQ_AMEND, PermissionCode.RFQ_CANCEL, PermissionCode.RFQ_MANAGE_COMMITTEE,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN, PermissionCode.BID_EVALUATE,
        PermissionCode.EVAL_VIEW, PermissionCode.EVAL_SCORE, PermissionCode.EVAL_OVERRIDE,
        PermissionCode.AWARD_RECOMMEND, PermissionCode.AWARD_APPROVE, PermissionCode.AWARD_SPLIT,
        PermissionCode.CONTRACT_CREATE, PermissionCode.CONTRACT_VIEW_ALL, PermissionCode.CONTRACT_ACTIVATE,
        PermissionCode.PO_CREATE, PermissionCode.PO_VIEW_ALL, PermissionCode.PO_VIEW_OWN, PermissionCode.PO_APPROVE, PermissionCode.PO_AMEND, PermissionCode.PO_CANCEL, PermissionCode.PO_CLOSE,
        PermissionCode.GRN_CREATE, PermissionCode.GRN_VIEW_ALL, PermissionCode.GRN_VIEW_OWN, PermissionCode.GRN_APPROVE,
        PermissionCode.INVOICE_VIEW_ALL, PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_MATCH, PermissionCode.INVOICE_APPROVE,
        PermissionCode.PAYMENT_VIEW_ALL, PermissionCode.PAYMENT_VIEW_OWN, PermissionCode.PAYMENT_INITIATE, PermissionCode.PAYMENT_APPROVE,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_QUALIFY,
        PermissionCode.VENDOR_BLACKLIST_INITIATE,
        PermissionCode.DOCUMENT_VIEW_ALL, PermissionCode.DOCUMENT_UPLOAD,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS, PermissionCode.ANALYTICS_EXPORT,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.WORKFLOW_CREATE, PermissionCode.WORKFLOW_UPDATE,
        PermissionCode.RULES_VIEW, PermissionCode.RULES_CREATE, PermissionCode.RULES_UPDATE,
        PermissionCode.USER_VIEW_ALL, PermissionCode.USER_CREATE, PermissionCode.USER_ASSIGN_ROLE,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_CANCEL,
        PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_ALL, PermissionCode.TICKET_ASSIGN,
        PermissionCode.TICKET_RESOLVE, PermissionCode.TICKET_CLOSE, PermissionCode.TICKET_REOPEN,
        PermissionCode.TICKET_ESCALATE, PermissionCode.TICKET_ADD_INTERNAL, PermissionCode.TICKET_LINK,
        PermissionCode.TICKET_EXPORT,
    ],
    "FINANCE_CONTROLLER": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE,
        PermissionCode.PO_VIEW_ALL, PermissionCode.PO_APPROVE,
        PermissionCode.GRN_VIEW_ALL, PermissionCode.GRN_APPROVE,
        PermissionCode.INVOICE_VIEW_ALL, PermissionCode.INVOICE_MATCH, PermissionCode.INVOICE_APPROVE,
        PermissionCode.PAYMENT_VIEW_ALL, PermissionCode.PAYMENT_INITIATE, PermissionCode.PAYMENT_APPROVE,
        PermissionCode.CONTRACT_VIEW_ALL,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS, PermissionCode.ANALYTICS_EXPORT,
        PermissionCode.DOCUMENT_VIEW_ALL, PermissionCode.DOCUMENT_UPLOAD,
        PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT,
        PermissionCode.MASTER_VIEW,
    ],
    "COMPLIANCE_OFFICER": [
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_BLACKLIST_INITIATE, PermissionCode.VENDOR_BLACKLIST_APPROVE,
        PermissionCode.VENDOR_UPDATE_COMPLIANCE,
        PermissionCode.CONTRACT_VIEW_ALL,
        PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT,
        PermissionCode.USER_VIEW_OWN,
        PermissionCode.MASTER_VIEW,
    ],
    "VENDOR_ADMIN": [
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE, PermissionCode.VENDOR_QUALIFY,
        PermissionCode.VENDOR_REJECT, PermissionCode.VENDOR_ACTIVATE, PermissionCode.VENDOR_SUSPEND,
        PermissionCode.VENDOR_REINSTATE, PermissionCode.VENDOR_MANAGE_CATEGORIES,
        PermissionCode.VENDOR_UPDATE_COMPLIANCE,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE, PermissionCode.MASTER_UPDATE,
        PermissionCode.USER_VIEW_ALL, PermissionCode.USER_CREATE, PermissionCode.USER_ASSIGN_ROLE,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT,
    ],
    "PROCUREMENT_ADMIN": [
        # Full procurement access
        PermissionCode.PR_CREATE, PermissionCode.PR_VIEW_ALL, PermissionCode.PR_SUBMIT,
        PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT, PermissionCode.PR_CANCEL,
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.RFQ_AMEND, PermissionCode.RFQ_CANCEL, PermissionCode.RFQ_MANAGE_COMMITTEE,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN, PermissionCode.BID_EVALUATE,
        PermissionCode.EVAL_VIEW, PermissionCode.EVAL_SCORE, PermissionCode.EVAL_OVERRIDE,
        PermissionCode.EVAL_SUBMIT_RECOMMENDATION, PermissionCode.EVAL_VIEW_COMPARATIVE,
        PermissionCode.AWARD_RECOMMEND, PermissionCode.AWARD_APPROVE, PermissionCode.AWARD_SPLIT,
        PermissionCode.CONTRACT_CREATE, PermissionCode.CONTRACT_VIEW_ALL, PermissionCode.CONTRACT_ACTIVATE,
        PermissionCode.CONTRACT_AMEND, PermissionCode.CONTRACT_RENEW, PermissionCode.CONTRACT_TERMINATE,
        PermissionCode.PO_CREATE, PermissionCode.PO_VIEW_ALL, PermissionCode.PO_APPROVE,
        PermissionCode.PO_AMEND, PermissionCode.PO_CANCEL,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE, PermissionCode.VENDOR_QUALIFY,
        PermissionCode.VENDOR_REJECT, PermissionCode.VENDOR_ACTIVATE, PermissionCode.VENDOR_SUSPEND,
        PermissionCode.VENDOR_BLACKLIST_INITIATE,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE, PermissionCode.MASTER_UPDATE, PermissionCode.MASTER_IMPORT,
        PermissionCode.USER_CREATE, PermissionCode.USER_VIEW_ALL, PermissionCode.USER_UPDATE_ALL,
        PermissionCode.USER_ASSIGN_ROLE,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.WORKFLOW_CREATE, PermissionCode.WORKFLOW_UPDATE,
        PermissionCode.WORKFLOW_ACTIVATE, PermissionCode.WORKFLOW_DEACTIVATE,
        PermissionCode.RULES_VIEW, PermissionCode.RULES_CREATE, PermissionCode.RULES_UPDATE,
        PermissionCode.RULES_DELETE,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS, PermissionCode.ANALYTICS_EXPORT,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_UPDATE, PermissionCode.ORG_MANAGE_SETTINGS, PermissionCode.ORG_VIEW_AUDIT,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_CANCEL,
        PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_ALL, PermissionCode.TICKET_ASSIGN,
        PermissionCode.TICKET_RESOLVE, PermissionCode.TICKET_CLOSE, PermissionCode.TICKET_REOPEN,
        PermissionCode.TICKET_ESCALATE, PermissionCode.TICKET_ADD_INTERNAL, PermissionCode.TICKET_CONFIG_SLA,
        PermissionCode.TICKET_EXPORT, PermissionCode.TICKET_LINK, PermissionCode.TICKET_CONFIG_CUSTOM_FIELDS,
        PermissionCode.TICKET_CONFIG_AUTOMATION,
    ],
    "SOURCING_MANAGER": [
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.RFQ_AMEND, PermissionCode.RFQ_CANCEL, PermissionCode.RFQ_MANAGE_COMMITTEE,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN, PermissionCode.BID_EVALUATE,
        PermissionCode.EVAL_VIEW, PermissionCode.EVAL_SCORE, PermissionCode.EVAL_VIEW_COMPARATIVE,
        PermissionCode.AWARD_RECOMMEND,
        PermissionCode.PR_VIEW_ALL,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS,
        PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_MONITOR,
        PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
        PermissionCode.MASTER_VIEW,
    ],
    "CFO": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE,
        PermissionCode.PO_VIEW_ALL, PermissionCode.PO_APPROVE,
        PermissionCode.INVOICE_VIEW_ALL, PermissionCode.INVOICE_APPROVE,
        PermissionCode.PAYMENT_VIEW_ALL, PermissionCode.PAYMENT_APPROVE, PermissionCode.PAYMENT_PROCESS,
        PermissionCode.CONTRACT_VIEW_ALL, PermissionCode.CONTRACT_ACTIVATE,
        PermissionCode.AWARD_APPROVE,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS, PermissionCode.ANALYTICS_EXPORT,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT, PermissionCode.ORG_MANAGE_LICENSE,
        PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.MASTER_VIEW,
    ],
    "SUPPLIER": [
        PermissionCode.VENDOR_VIEW_OWN,
        PermissionCode.RFQ_VIEW_OWN,
        PermissionCode.BID_SUBMIT, PermissionCode.BID_VIEW_OWN, PermissionCode.BID_REVISE, PermissionCode.BID_WITHDRAW,
        PermissionCode.INVOICE_SUBMIT, PermissionCode.INVOICE_VIEW_OWN,
        PermissionCode.PO_ACKNOWLEDGE, PermissionCode.PO_VIEW_OWN,
        PermissionCode.GRN_VIEW_OWN,
        PermissionCode.PAYMENT_VIEW_OWN,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_OWN,
        PermissionCode.NOTIFICATION_VIEW_OWN,
        PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.CONTRACT_VIEW_OWN,
        PermissionCode.MASTER_VIEW,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_OWN,
    ],
    "SUPPLIER_ADMIN": [
        PermissionCode.VENDOR_VIEW_OWN,
        PermissionCode.RFQ_VIEW_OWN,
        PermissionCode.BID_SUBMIT, PermissionCode.BID_VIEW_OWN, PermissionCode.BID_REVISE, PermissionCode.BID_WITHDRAW,
        PermissionCode.INVOICE_SUBMIT, PermissionCode.INVOICE_VIEW_OWN,
        PermissionCode.PO_ACKNOWLEDGE, PermissionCode.PO_VIEW_OWN,
        PermissionCode.GRN_VIEW_OWN,
        PermissionCode.PAYMENT_VIEW_OWN,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_OWN,
        PermissionCode.NOTIFICATION_VIEW_OWN,
        PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.CONTRACT_VIEW_OWN,
        PermissionCode.MASTER_VIEW,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_OWN,
    ],
    "SUPPLIER_USER": [
        PermissionCode.VENDOR_VIEW_OWN,
        PermissionCode.RFQ_VIEW_OWN,
        PermissionCode.BID_SUBMIT, PermissionCode.BID_VIEW_OWN,
        PermissionCode.INVOICE_SUBMIT, PermissionCode.INVOICE_VIEW_OWN,
        PermissionCode.PO_VIEW_OWN,
        PermissionCode.GRN_VIEW_OWN,
        PermissionCode.PAYMENT_VIEW_OWN,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_OWN,
        PermissionCode.NOTIFICATION_VIEW_OWN,
        PermissionCode.USER_VIEW_OWN,
        PermissionCode.CONTRACT_VIEW_OWN,
        PermissionCode.MASTER_VIEW,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_OWN,
    ],
    "SUPERADMIN": [
        # Full system access - all permissions except permanently denied
        PermissionCode.ORG_VIEW, PermissionCode.ORG_UPDATE, PermissionCode.ORG_MANAGE_SETTINGS,
        PermissionCode.ORG_MANAGE_LICENSE, PermissionCode.ORG_VIEW_AUDIT, PermissionCode.ORG_MANAGE_USERS,
        PermissionCode.USER_CREATE, PermissionCode.USER_VIEW_ALL, PermissionCode.USER_UPDATE_ALL,
        PermissionCode.USER_DEACTIVATE, PermissionCode.USER_ASSIGN_ROLE, PermissionCode.USER_MANAGE_PERMISSIONS,
        PermissionCode.ADMIN_VIEW_SETTINGS, PermissionCode.ADMIN_MANAGE_SETTINGS,
        PermissionCode.ADMIN_VIEW_AUDIT_LOG, PermissionCode.ADMIN_MANAGE_ROLES,
        PermissionCode.ADMIN_MANAGE_SYSTEM, PermissionCode.ADMIN_VIEW_HEALTH,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE, PermissionCode.MASTER_UPDATE,
        PermissionCode.MASTER_DELETE, PermissionCode.MASTER_IMPORT, PermissionCode.MASTER_EXPORT,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_ALL, PermissionCode.TICKET_ASSIGN,
        PermissionCode.TICKET_RESOLVE, PermissionCode.TICKET_CLOSE, PermissionCode.TICKET_REOPEN,
        PermissionCode.TICKET_ESCALATE, PermissionCode.TICKET_ADD_INTERNAL, PermissionCode.TICKET_CONFIG_SLA,
        PermissionCode.TICKET_EXPORT, PermissionCode.TICKET_LINK, PermissionCode.TICKET_CONFIG_CUSTOM_FIELDS,
        PermissionCode.TICKET_CONFIG_AUTOMATION,
    ],
    "ORG_ADMIN": [
        PermissionCode.ORG_VIEW, PermissionCode.ORG_UPDATE, PermissionCode.ORG_MANAGE_SETTINGS, PermissionCode.ORG_VIEW_AUDIT,
        PermissionCode.USER_CREATE, PermissionCode.USER_VIEW_ALL, PermissionCode.USER_UPDATE_ALL,
        PermissionCode.USER_DEACTIVATE, PermissionCode.USER_ASSIGN_ROLE,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE, PermissionCode.MASTER_UPDATE,
        PermissionCode.ADMIN_VIEW_SETTINGS, PermissionCode.ADMIN_MANAGE_SETTINGS, PermissionCode.ADMIN_VIEW_AUDIT_LOG,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.WORKFLOW_CREATE, PermissionCode.WORKFLOW_UPDATE,
        PermissionCode.RULES_VIEW, PermissionCode.RULES_CREATE,
        PermissionCode.TICKET_CREATE, PermissionCode.TICKET_VIEW_ALL, PermissionCode.TICKET_ASSIGN,
        PermissionCode.TICKET_RESOLVE, PermissionCode.TICKET_CLOSE, PermissionCode.TICKET_REOPEN,
        PermissionCode.TICKET_ESCALATE, PermissionCode.TICKET_ADD_INTERNAL, PermissionCode.TICKET_CONFIG_SLA,
        PermissionCode.TICKET_EXPORT, PermissionCode.TICKET_LINK, PermissionCode.TICKET_CONFIG_CUSTOM_FIELDS,
        PermissionCode.TICKET_CONFIG_AUTOMATION,
    ],
}


async def seed_data() -> None:
    logger.info("Starting master data seeding...")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with session_factory() as session:
        # 1. Seed permissions
        perm_code_to_id: dict[str, str] = {}
        seen_codes: set[str] = set()
        for attr_name in dir(PermissionCode):
            if attr_name.startswith("_"):
                continue
            code_val = getattr(PermissionCode, attr_name)
            if not isinstance(code_val, str) or code_val in seen_codes:
                continue
            seen_codes.add(code_val)
            module = code_val.split(".")[0] if "." in code_val else "system"
            display_name = attr_name.replace("_", " ").title()
            perm_id = str(uuid4())
            await session.execute(text("""
                INSERT INTO permissions (id, code, name, module)
                VALUES (:id, :code, :name, :module)
                ON CONFLICT (code) DO NOTHING
            """), {"id": perm_id, "code": code_val, "name": display_name, "module": module})
            # Retrieve actual ID (may have existed already)
            result = await session.execute(
                text("SELECT id FROM permissions WHERE code = :code"), {"code": code_val}
            )
            row = result.fetchone()
            if row:
                perm_code_to_id[code_val] = str(row[0])

        logger.info("Seeded %d permissions", len(perm_code_to_id))

        # 2. Ensure system org and default org exist (FK required by roles.org_id)
        SYSTEM_ORG_ID = "00000000-0000-0000-0000-000000000000"
        DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"
        await session.execute(text("""
            INSERT INTO organizations (id, name, legal_name, country_code, version)
            VALUES (:id, 'System Organization', 'System Organization', 'IN', 1)
            ON CONFLICT (id) DO NOTHING
        """), {"id": SYSTEM_ORG_ID})
        await session.execute(text("""
            INSERT INTO organizations (id, name, legal_name, country_code, version)
            VALUES (:id, 'Default Organization', 'Default Organization Private Limited', 'IN', 1)
            ON CONFLICT (id) DO NOTHING
        """), {"id": DEFAULT_ORG_ID})

        target_org_ids = [SYSTEM_ORG_ID, DEFAULT_ORG_ID]

        # 3. Seed roles and role-permission mappings for each organization
        total_mappings = 0
        for current_org_id in target_org_ids:
            role_code_to_id: dict[str, str] = {}
            for role in ROLES:
                role_id = str(uuid4())
                await session.execute(text("""
                    INSERT INTO roles (id, org_id, code, name, is_system_role, is_supplier_role, is_active, version)
                    VALUES (:id, :org_id, :code, :name, :is_system_role, :is_supplier_role, true, 1)
                    ON CONFLICT (org_id, code) DO NOTHING
                """), {
                    "id": role_id,
                    "org_id": current_org_id,
                    "code": role["code"],
                    "name": role["name"],
                    "is_system_role": role["is_system_role"],
                    "is_supplier_role": role["is_supplier_role"],
                })
                result = await session.execute(
                    text("SELECT id FROM roles WHERE code = :code AND org_id = :org_id"),
                    {"code": role["code"], "org_id": current_org_id}
                )
                row = result.fetchone()
                if row:
                    role_code_to_id[role["code"]] = str(row[0])

            for role_code, perm_codes in ROLE_PERMISSIONS.items():
                role_id = role_code_to_id.get(role_code)
                if not role_id:
                    continue
                for perm_code in perm_codes:
                    perm_id = perm_code_to_id.get(perm_code)
                    if not perm_id:
                        logger.warning("Permission code not found: %s", perm_code)
                        continue
                    await session.execute(text("""
                        INSERT INTO role_permissions (id, org_id, role_id, permission_id)
                        VALUES (:id, :org_id, :role_id, :permission_id)
                        ON CONFLICT (org_id, role_id, permission_id) DO NOTHING
                    """), {
                        "id": str(uuid4()),
                        "org_id": current_org_id,
                        "role_id": role_id,
                        "permission_id": perm_id,
                    })
                    total_mappings += 1

        logger.info("Seeded %d role-permission mappings across %d organizations", total_mappings, len(target_org_ids))

        # 4. Seed Incoterms
        for target_org in [SYSTEM_ORG_ID, DEFAULT_ORG_ID]:
            for term in INCOTERMS:
                await session.execute(text("""
                    INSERT INTO incoterms (id, org_id, code, name, edition_year, risk_transfer_point, is_active, version)
                    VALUES (:id, :org_id, :code, :name, :edition_year, :risk_transfer_point, true, 1)
                    ON CONFLICT (org_id, code) DO NOTHING
                """), {
                    "id": str(uuid4()),
                    "org_id": target_org,
                    "code": term["code"],
                    "name": term["name"],
                    "edition_year": term["edition_year"],
                    "risk_transfer_point": term["risk_transfer_point"],
                })

        # 5. Ensure organizations exist
        DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"
        await session.execute(text("""
            INSERT INTO organizations (id, name, legal_name, country_code, version)
            VALUES (:id, 'Default Organization', 'Default Organization Private Limited', 'IN', 1)
            ON CONFLICT (id) DO NOTHING
        """), {"id": DEFAULT_ORG_ID})

        for target_org in [SYSTEM_ORG_ID, DEFAULT_ORG_ID]:
            # Seed Categories (Level 1 first, then children)
            for cat in DEFAULT_CATEGORIES:
                if cat["parent_code"] is None:
                    await session.execute(text("""
                        INSERT INTO categories (id, org_id, code, name, parent_id, level, is_active, version)
                        VALUES (:id, :org_id, :code, :name, NULL, :level, true, 1)
                        ON CONFLICT (org_id, code) DO NOTHING
                    """), {
                        "id": str(uuid4()),
                        "org_id": target_org,
                        "code": cat["code"],
                        "name": cat["name"],
                        "level": cat["level"],
                    })

            for cat in DEFAULT_CATEGORIES:
                if cat["parent_code"] is not None:
                    p_res = await session.execute(
                        text("SELECT id FROM categories WHERE org_id = :org_id AND code = :code"),
                        {"org_id": target_org, "code": cat["parent_code"]}
                    )
                    p_row = p_res.fetchone()
                    parent_id = str(p_row[0]) if p_row else None
                    await session.execute(text("""
                        INSERT INTO categories (id, org_id, code, name, parent_id, level, is_active, version)
                        VALUES (:id, :org_id, :code, :name, :parent_id, :level, true, 1)
                        ON CONFLICT (org_id, code) DO NOTHING
                    """), {
                        "id": str(uuid4()),
                        "org_id": target_org,
                        "code": cat["code"],
                        "name": cat["name"],
                        "parent_id": parent_id,
                        "level": cat["level"],
                    })

            # Seed UOMs
            for uom in DEFAULT_UOMS:
                await session.execute(text("""
                    INSERT INTO uom_master (id, org_id, code, name, is_active, version)
                    VALUES (:id, :org_id, :code, :name, true, 1)
                    ON CONFLICT (org_id, code) DO NOTHING
                """), {"id": str(uuid4()), "org_id": target_org, "code": uom["code"], "name": uom["name"]})

            # Seed Currencies
            for curr in DEFAULT_CURRENCIES:
                await session.execute(text("""
                    INSERT INTO currency_master (id, org_id, code, name, symbol, decimal_places, exchange_rate_to_base, is_base_currency, is_active, version)
                    VALUES (:id, :org_id, :code, :name, :symbol, 2, :exchange_rate_to_base, :is_base_currency, true, 1)
                    ON CONFLICT (org_id, code) DO NOTHING
                """), {
                    "id": str(uuid4()),
                    "org_id": target_org,
                    "code": curr["code"],
                    "name": curr["name"],
                    "symbol": curr["symbol"],
                    "exchange_rate_to_base": curr["exchange_rate_to_base"],
                    "is_base_currency": curr["is_base_currency"],
                })

            # Seed Payment Terms
            for pt in DEFAULT_PAYMENT_TERMS:
                await session.execute(text("""
                    INSERT INTO payment_terms (id, org_id, code, name, description, payment_days, net_days, advance_percentage, retention_percentage, discount_percentage, discount_days, is_active, version)
                    VALUES (:id, :org_id, :code, :name, :description, :payment_days, :net_days, :advance_percentage, :retention_percentage, :discount_percentage, :discount_days, true, 1)
                    ON CONFLICT (org_id, code) DO NOTHING
                """), {
                    "id": str(uuid4()),
                    "org_id": target_org,
                    "code": pt["code"],
                    "name": pt["name"],
                    "description": pt["description"],
                    "payment_days": pt["payment_days"],
                    "net_days": pt["net_days"],
                    "advance_percentage": pt["advance_percentage"],
                    "retention_percentage": pt["retention_percentage"],
                    "discount_percentage": pt["discount_percentage"],
                    "discount_days": pt["discount_days"],
                })

            # Seed Tax Codes
            for tc in DEFAULT_TAX_CODES:
                await session.execute(text("""
                    INSERT INTO tax_codes (id, org_id, code, name, tax_type, rate, hsn_chapter, effective_from, is_active, version)
                    VALUES (:id, :org_id, :code, :name, :tax_type, :rate, :hsn_chapter, :effective_from, true, 1)
                    ON CONFLICT (org_id, code, effective_from) DO NOTHING
                """), {
                    "id": str(uuid4()),
                    "org_id": target_org,
                    "code": tc["code"],
                    "name": tc["name"],
                    "tax_type": tc["tax_type"],
                    "rate": tc["rate"],
                    "hsn_chapter": tc["hsn_chapter"],
                    "effective_from": date(2026, 1, 1),
                })

            # Seed Delivery Locations
            for loc in DEFAULT_DELIVERY_LOCATIONS:
                await session.execute(text("""
                    INSERT INTO delivery_locations (id, org_id, code, name, address_line1, city, state, postal_code, country_code, is_active, version)
                    VALUES (:id, :org_id, :code, :name, :address_line1, :city, :state, :postal_code, :country_code, true, 1)
                    ON CONFLICT (org_id, code) DO NOTHING
                """), {
                    "id": str(uuid4()),
                    "org_id": target_org,
                    "code": loc["code"],
                    "name": loc["name"],
                    "address_line1": loc["address_line1"],
                    "city": loc["city"],
                    "state": loc["state"],
                    "postal_code": loc["postal_code"],
                    "country_code": loc["country_code"],
                })

            # Seed Holidays
            for hol in DEFAULT_HOLIDAYS:
                await session.execute(text("""
                    INSERT INTO holiday_master (id, org_id, name, holiday_date, is_active, version)
                    VALUES (:id, :org_id, :name, :holiday_date, true, 1)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": str(uuid4()),
                    "org_id": target_org,
                    "name": hol["name"],
                    "holiday_date": hol["holiday_date"],
                })

            # 6. Seed Default Legal Entity, Business Unit, and Cost Center
            le_id = str(uuid4())
            await session.execute(text("""
                INSERT INTO legal_entities (id, org_id, name, registration_number, country_code, version)
                VALUES (:id, :org_id, 'Corporate Legal Entity', 'REG-001', 'IN', 1)
                ON CONFLICT (org_id, registration_number) DO NOTHING
            """), {"id": le_id, "org_id": target_org})

            le_res = await session.execute(
                text("SELECT id FROM legal_entities WHERE org_id = :org_id AND registration_number = 'REG-001'"),
                {"org_id": target_org}
            )
            real_le_id = str(le_res.scalar_one())

            bu_id = str(uuid4())
            await session.execute(text("""
                INSERT INTO business_units (id, org_id, legal_entity_id, code, name, default_currency, is_active, version)
                VALUES (:id, :org_id, :legal_entity_id, 'BU-CORP', 'Corporate & HQ', 'INR', true, 1)
                ON CONFLICT (org_id, code) DO NOTHING
            """), {"id": bu_id, "org_id": target_org, "legal_entity_id": real_le_id})

            bu_res = await session.execute(
                text("SELECT id FROM business_units WHERE org_id = :org_id AND code = 'BU-CORP'"),
                {"org_id": target_org}
            )
            real_bu_id = str(bu_res.scalar_one())

            cc_id = str(uuid4())
            await session.execute(text("""
                INSERT INTO cost_centers (id, org_id, business_unit_id, code, name, annual_budget, available_budget, is_active, version)
                VALUES (:id, :org_id, :business_unit_id, 'CC-EXEC', 'Executive & Administration', 10000000, 10000000, true, 1)
                ON CONFLICT (org_id, code) DO NOTHING
            """), {"id": cc_id, "org_id": target_org, "business_unit_id": real_bu_id})

        logger.info("Seeded UOMs, Currencies, Payment Terms, Tax Codes, Locations, Holidays, Legal Entity, Business Unit, and Cost Center")

        await session.commit()
        logger.info("Master data seeding completed successfully.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_data())
