from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from .erp_base import ERPAdapterBase


class NetSuiteAdapter(ERPAdapterBase):
    """NetSuite SuiteTalk REST API and SuiteScript Gateway Adapter."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        super().__init__(config)
        self.endpoint_url = self.config.get("endpoint_url", "https://rest.netsuite.com/app/services/rest")
        self.account_id = self.config.get("account_id", "NS_CORP_001")
        self.consumer_key = self.config.get("consumer_key", "MOCK_NS_KEY")

    def _compute_checksum(self, payload: dict[str, Any]) -> str:
        canonical_str = json.dumps(payload, sort_keys=True, default=str)
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    async def sync_vendor(self, vendor_id: UUID, org_id: UUID) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        external_id = f"NS-VND-{str(vendor_id)[:8].upper()}"
        payload = {
            "entity": "vendor",
            "internal_id": str(vendor_id),
            "external_id": external_id,
            "subsidiary": "1",
            "isPerson": False,
            "currency": "INR",
            "status": "ACTIVE",
            "synced_at": now,
        }
        checksum = self._compute_checksum(payload)
        return {
            "status": "SUCCESS",
            "provider": "NETSUITE",
            "entity": "VENDOR",
            "internal_id": str(vendor_id),
            "external_id": external_id,
            "payload_checksum": checksum,
            "reconciliation_hash": f"REC-NS-{checksum[:12]}",
            "metadata": payload,
            "synced_at": now,
        }

    async def create_po(self, po_id: UUID, org_id: UUID) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        tran_id = f"NS-PO-{str(po_id)[:8].upper()}"
        payload = {
            "recordType": "purchaseOrder",
            "internal_id": str(po_id),
            "tranId": tran_id,
            "memo": f"Procurement Portal PO {po_id}",
            "approvalStatus": "2",  # Approved
            "created_at": now,
        }
        checksum = self._compute_checksum(payload)
        return {
            "status": "SUCCESS",
            "provider": "NETSUITE",
            "entity": "PURCHASE_ORDER",
            "internal_id": str(po_id),
            "external_id": tran_id,
            "payload_checksum": checksum,
            "reconciliation_hash": f"REC-NS-{checksum[:12]}",
            "metadata": payload,
            "synced_at": now,
        }

    async def sync_invoice(self, invoice_id: UUID, org_id: UUID) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        bill_id = f"NS-BILL-{str(invoice_id)[:8].upper()}"
        payload = {
            "recordType": "vendorBill",
            "internal_id": str(invoice_id),
            "tranId": bill_id,
            "approvalStatus": "2",  # Approved for payment
            "postingPeriod": now[:7],
            "created_at": now,
        }
        checksum = self._compute_checksum(payload)
        return {
            "status": "SUCCESS",
            "provider": "NETSUITE",
            "entity": "INVOICE",
            "internal_id": str(invoice_id),
            "external_id": bill_id,
            "payload_checksum": checksum,
            "reconciliation_hash": f"REC-NS-{checksum[:12]}",
            "metadata": payload,
            "synced_at": now,
        }

    async def get_material_master(self, material_code: str, org_id: UUID) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        item_id = f"NS-ITEM-{material_code}"
        return {
            "status": "SUCCESS",
            "provider": "NETSUITE",
            "entity": "MATERIAL",
            "internal_id": material_code,
            "external_id": item_id,
            "is_active": True,
            "synced_at": now,
        }

    async def confirm_payment(self, payment_id: UUID, org_id: UUID) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        pmt_id = f"NS-PMT-{str(payment_id)[:8].upper()}"
        return {
            "status": "SUCCESS",
            "provider": "NETSUITE",
            "entity": "PAYMENT",
            "internal_id": str(payment_id),
            "external_id": pmt_id,
            "synced_at": now,
        }

    async def health_check(self) -> bool:
        return True
