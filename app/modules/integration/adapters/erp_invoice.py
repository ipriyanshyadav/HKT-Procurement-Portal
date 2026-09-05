from __future__ import annotations

import hashlib
import json
from typing import Any, Dict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.invoice.models import Invoice


class ERPInvoiceAdapter:
    """Handles mapping, payload formatting, and synchronization for Invoice entity."""

    @staticmethod
    def generate_idempotency_key(data: Dict[str, Any]) -> str:
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    async def build_outbound_payload(self, db: AsyncSession, invoice_id: UUID, org_id: UUID) -> Dict[str, Any]:
        stmt = select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.org_id == org_id,
            Invoice.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        invoice = result.scalar_one_or_none()
        if not invoice:
            return {"error": f"Invoice {invoice_id} not found", "invoice_id": str(invoice_id)}

        payload = {
            "entity": "INVOICE",
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "po_id": str(invoice.po_id) if invoice.po_id else None,
            "vendor_id": str(invoice.vendor_id),
            "total_amount": str(invoice.total_amount),
            "currency": getattr(invoice, "currency", "INR"),
            "match_status": getattr(invoice, "match_status", "MATCHED"),
            "status": str(invoice.status.value if hasattr(invoice.status, "value") else invoice.status),
            "invoice_date": str(invoice.invoice_date) if getattr(invoice, "invoice_date", None) else None,
            "due_date": str(invoice.due_date) if getattr(invoice, "due_date", None) else None,
        }
        payload["idempotency_key"] = self.generate_idempotency_key(payload)
        return payload
