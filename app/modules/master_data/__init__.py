"""
Master Data Module.
Responsibility: Handles operations for Master Data (categories, UOM, currency, payment terms, tax, locations, holidays, ERP mapping).
Dependencies: db, core
Events Published: procurement.master_data exchange
Events Consumed: none
"""
from __future__ import annotations

from app.modules.master_data.category.service import category_service
from app.modules.master_data.currency.service import currency_service
from app.modules.master_data.erp_mapping.service import erp_mapping_service
from app.modules.master_data.holiday.service import holiday_service
from app.modules.master_data.import_service import master_data_import_service
from app.modules.master_data.location.service import delivery_location_service
from app.modules.master_data.payment_terms.service import payment_terms_service
from app.modules.master_data.tax.service import tax_service
from app.modules.master_data.uom.service import uom_service

__all__ = [
    "category_service",
    "uom_service",
    "currency_service",
    "payment_terms_service",
    "tax_service",
    "delivery_location_service",
    "holiday_service",
    "erp_mapping_service",
    "master_data_import_service",
]
