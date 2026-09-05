from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.vendor.models import Vendor, VendorBankAccount


class ERPVendorAdapter:
    """Handles mapping, payload formatting, and synchronization for Vendor entity."""

    @staticmethod
    def generate_idempotency_key(data: Dict[str, Any]) -> str:
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    async def build_outbound_payload(self, db: AsyncSession, vendor_id: UUID, org_id: UUID) -> Dict[str, Any]:
        stmt = select(Vendor).where(
            Vendor.id == vendor_id,
            Vendor.org_id == org_id,
            Vendor.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        vendor = result.scalar_one_or_none()
        if not vendor:
            return {"error": f"Vendor {vendor_id} not found", "vendor_id": str(vendor_id)}

        bank_stmt = select(VendorBankAccount).where(
            VendorBankAccount.vendor_id == vendor_id,
            VendorBankAccount.deleted_at.is_(None),
        )
        bank_res = await db.execute(bank_stmt)
        bank_accounts = bank_res.scalars().all()

        payload = {
            "entity": "VENDOR",
            "vendor_id": str(vendor.id),
            "vendor_code": vendor.vendor_code,
            "company_name": vendor.company_name,
            "legal_name": vendor.legal_name or vendor.company_name,
            "pan": getattr(vendor, "pan", None),
            "gstin": getattr(vendor, "gstin", None),
            "msme_type": getattr(vendor, "msme_type", None),
            "status": str(vendor.status.value if hasattr(vendor.status, "value") else vendor.status),
            "bank_accounts": [
                {
                    "bank_name": b.bank_name,
                    "account_number": b.account_number,
                    "ifsc_code": b.ifsc_code,
                    "is_primary": b.is_primary,
                }
                for b in bank_accounts
            ],
        }
        payload["idempotency_key"] = self.generate_idempotency_key(payload)
        return payload
