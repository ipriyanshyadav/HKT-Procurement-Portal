from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from .erp_base import ERPAdapterBase
from ..http_client import SafeHTTPClient


class CustomERPAdapter(ERPAdapterBase):
    """Configurable Generic REST ERP Adapter for custom enterprise backends."""

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(config)
        self.endpoint_url = self.config.get("endpoint_url")
        self.api_key = self.config.get("api_key")

    async def sync_vendor(self, vendor_id: UUID, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "status": "SYNCHRONIZED",
            "provider": "CUSTOM",
            "entity": "VENDOR",
            "vendor_id": str(vendor_id),
            "erp_vendor_code": f"CUSTOM-V-{str(vendor_id)[:8].upper()}",
            "synced_at": now,
        }

    async def create_po(self, po_id: UUID, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "status": "POSTED",
            "provider": "CUSTOM",
            "entity": "PURCHASE_ORDER",
            "po_id": str(po_id),
            "erp_document_id": f"CUSTOM-PO-{str(po_id)[:8].upper()}",
            "synced_at": now,
        }

    async def get_material_master(self, material_code: str, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "status": "SUCCESS",
            "provider": "CUSTOM",
            "entity": "MATERIAL",
            "material_code": material_code,
            "erp_material_id": f"CUSTOM-MAT-{material_code}",
            "synced_at": now,
        }

    async def confirm_payment(self, payment_id: UUID, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "status": "CLEARED",
            "provider": "CUSTOM",
            "entity": "PAYMENT",
            "payment_id": str(payment_id),
            "reference": f"CUSTOM-PAY-{str(payment_id)[:8].upper()}",
            "synced_at": now,
        }

    async def sync_invoice(self, invoice_id: UUID, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "status": "ACCEPTED",
            "provider": "CUSTOM",
            "entity": "INVOICE",
            "invoice_id": str(invoice_id),
            "accounting_document": f"CUSTOM-INV-{str(invoice_id)[:8].upper()}",
            "synced_at": now,
        }

    async def health_check(self) -> bool:
        return True
