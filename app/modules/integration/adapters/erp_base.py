from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID


class ERPAdapterBase(ABC):
    """Abstract Base Class that all ERP integration adapters must implement."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config: dict[str, Any] = config or {}

    @abstractmethod
    async def sync_vendor(self, vendor_id: UUID, org_id: UUID) -> dict[str, Any]:
        """Synchronize vendor master data with the ERP."""
        ...

    @abstractmethod
    async def create_po(self, po_id: UUID, org_id: UUID) -> dict[str, Any]:
        """Post a purchase order to the ERP."""
        ...

    @abstractmethod
    async def get_material_master(self, material_code: str, org_id: UUID) -> dict[str, Any]:
        """Retrieve material master information from the ERP."""
        ...

    @abstractmethod
    async def confirm_payment(self, payment_id: UUID, org_id: UUID) -> dict[str, Any]:
        """Notify or reconcile payment execution with the ERP."""
        ...

    @abstractmethod
    async def sync_invoice(self, invoice_id: UUID, org_id: UUID) -> dict[str, Any]:
        """Synchronize matched invoice with the ERP accounts payable."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Verify connectivity to the target ERP endpoint."""
        ...


class ERPAdapterFactory:
    """Factory to instantiate the appropriate ERP adapter based on provider setting."""

    @staticmethod
    def get_adapter(erp_provider: str | None, erp_config: dict[str, Any] | None = None) -> ERPAdapterBase:
        provider = (erp_provider or "CUSTOM").strip().upper()
        if provider in ("SAP", "SAP_S4HANA"):
            from .erp_sap import SAPAdapter
            return SAPAdapter(erp_config)
        if provider in ("NETSUITE", "NET_SUITE"):
            from .erp_netsuite import NetSuiteAdapter
            return NetSuiteAdapter(erp_config)
        if provider in ("ORACLE", "ORACLE_CLOUD"):
            from .erp_oracle import OracleAdapter
            return OracleAdapter(erp_config)
        if provider == "TALLY":
            from .erp_tally import TallyXMLAdapter
            return TallyXMLAdapter(erp_config)
        from .erp_custom import CustomERPAdapter
        return CustomERPAdapter(erp_config)
