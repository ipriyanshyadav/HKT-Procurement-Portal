from __future__ import annotations

import hashlib
import json
from typing import Any, Dict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.purchase_order.models import PurchaseOrder, PoLine


class ERPPOAdapter:
    """Handles mapping, payload formatting, and synchronization for Purchase Order entity."""

    @staticmethod
    def generate_idempotency_key(data: Dict[str, Any]) -> str:
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    async def build_outbound_payload(self, db: AsyncSession, po_id: UUID, org_id: UUID) -> Dict[str, Any]:
        stmt = select(PurchaseOrder).where(
            PurchaseOrder.id == po_id,
            PurchaseOrder.org_id == org_id,
            PurchaseOrder.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        po = result.scalar_one_or_none()
        if not po:
            return {"error": f"Purchase Order {po_id} not found", "po_id": str(po_id)}

        lines_stmt = select(PoLine).where(
            PoLine.po_id == po_id,
            PoLine.deleted_at.is_(None),
        )
        lines_res = await db.execute(lines_stmt)
        lines = lines_res.scalars().all()

        payload = {
            "entity": "PURCHASE_ORDER",
            "po_id": str(po.id),
            "po_number": po.po_number,
            "title": po.title,
            "vendor_id": str(po.vendor_id),
            "total_value": str(po.total_value),
            "currency": po.currency,
            "status": str(po.status.value if hasattr(po.status, "value") else po.status),
            "payment_terms": getattr(po, "payment_terms", None),
            "incoterms": getattr(po, "incoterms", None),
            "delivery_date": str(po.expected_delivery_date) if getattr(po, "expected_delivery_date", None) else None,
            "lines": [
                {
                    "line_number": l.line_number,
                    "description": getattr(l, "item_description", getattr(l, "description", "")),
                    "quantity": str(l.quantity),
                    "unit_price": str(l.unit_price),
                    "uom": getattr(l, "uom_id", None),
                    "tax_rate": str(getattr(l, "tax_rate", 0)),
                    "total_amount": str(getattr(l, "total_amount", l.quantity * l.unit_price)),
                }
                for l in lines
            ],
        }
        payload["idempotency_key"] = self.generate_idempotency_key(payload)
        return payload
