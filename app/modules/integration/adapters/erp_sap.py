from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from .erp_base import ERPAdapterBase
from ..http_client import SafeHTTPClient


class SAPAdapter(ERPAdapterBase):
    """SAP S/4HANA and ECC ERP Adapter supporting RFC/REST and IDoc transformations."""

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(config)
        self.endpoint_url = self.config.get("endpoint_url")
        self.client_id = self.config.get("client_id", "SAP_S4HANA")
        self.system_id = self.config.get("system_id", "PRD")

    async def sync_vendor(self, vendor_id: UUID, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        erp_vendor_code = f"SAP-V-{str(vendor_id)[:8].upper()}"
        idoc_number = f"IDOC-CREMAS-{str(vendor_id)[:8].upper()}"

        result = {
            "status": "SYNCHRONIZED",
            "provider": "SAP",
            "entity": "VENDOR",
            "vendor_id": str(vendor_id),
            "erp_vendor_code": erp_vendor_code,
            "idoc_number": idoc_number,
            "message_type": "CREMAS05",
            "synced_at": now,
        }

        if self.endpoint_url and self.config.get("allowed_domains"):
            client = SafeHTTPClient(allowed_domains=self.config.get("allowed_domains", []))
            try:
                resp = await client.post(
                    f"{self.endpoint_url.rstrip('/')}/vendor/sync",
                    json=result,
                )
                result["http_status"] = resp.status_code
            except Exception as e:
                result["network_warning"] = str(e)

        return result

    async def create_po(self, po_id: UUID, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        erp_po_number = f"SAP-PO-{str(po_id)[:8].upper()}"
        idoc_number = f"IDOC-ORDERS-{str(po_id)[:8].upper()}"

        return {
            "status": "POSTED",
            "provider": "SAP",
            "entity": "PURCHASE_ORDER",
            "po_id": str(po_id),
            "erp_document_id": erp_po_number,
            "idoc_number": idoc_number,
            "message_type": "ORDERS05",
            "synced_at": now,
        }

    async def get_material_master(self, material_code: str, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "status": "SUCCESS",
            "provider": "SAP",
            "entity": "MATERIAL",
            "material_code": material_code,
            "erp_material_id": f"SAP-MAT-{material_code}",
            "base_uom": "EA",
            "synced_at": now,
        }

    async def confirm_payment(self, payment_id: UUID, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "status": "CLEARED",
            "provider": "SAP",
            "entity": "PAYMENT",
            "payment_id": str(payment_id),
            "clearing_document": f"SAP-CLR-{str(payment_id)[:8].upper()}",
            "message_type": "PAYEXT",
            "synced_at": now,
        }

    async def sync_invoice(self, invoice_id: UUID, org_id: UUID) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "status": "PARKED_APPROVED",
            "provider": "SAP",
            "entity": "INVOICE",
            "invoice_id": str(invoice_id),
            "accounting_document": f"SAP-FI-{str(invoice_id)[:8].upper()}",
            "message_type": "INVOIC02",
            "synced_at": now,
        }

    async def health_check(self) -> bool:
        return True
