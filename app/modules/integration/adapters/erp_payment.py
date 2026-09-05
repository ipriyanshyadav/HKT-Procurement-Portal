from __future__ import annotations

import hashlib
import json
from typing import Any, Dict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.payment.models import PaymentRecord


class ERPPaymentAdapter:
    """Handles mapping, payload formatting, and synchronization for Payment entity."""

    @staticmethod
    def generate_idempotency_key(data: Dict[str, Any]) -> str:
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    async def build_outbound_payload(self, db: AsyncSession, payment_id: UUID, org_id: UUID) -> Dict[str, Any]:
        stmt = select(PaymentRecord).where(
            PaymentRecord.id == payment_id,
            PaymentRecord.org_id == org_id,
            PaymentRecord.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        payment = result.scalar_one_or_none()
        if not payment:
            return {"error": f"PaymentRecord {payment_id} not found", "payment_id": str(payment_id)}

        payload = {
            "entity": "PAYMENT",
            "payment_id": str(payment.id),
            "payment_reference": getattr(payment, "payment_reference", None) or getattr(payment, "reference_number", None),
            "invoice_id": str(payment.invoice_id) if getattr(payment, "invoice_id", None) else None,
            "vendor_id": str(payment.vendor_id) if getattr(payment, "vendor_id", None) else None,
            "amount": str(payment.amount),
            "currency": getattr(payment, "currency", "INR"),
            "utr_number": getattr(payment, "utr_number", None),
            "status": str(payment.status.value if hasattr(payment.status, "value") else payment.status),
            "payment_date": str(payment.payment_date) if getattr(payment, "payment_date", None) else None,
        }
        payload["idempotency_key"] = self.generate_idempotency_key(payload)
        return payload
