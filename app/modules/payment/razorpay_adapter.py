from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import uuid4
import httpx
from loguru import logger
from app.config import settings


class RazorpayPaymentAdapter:
    """
    Razorpay Payouts & Payment Gateway Execution Adapter with HMAC Webhook Verification.
    Supports NEFT, RTGS, IMPS payout modes and validates X-Razorpay-Signature.
    """

    def __init__(
        self,
        key_id: Optional[str] = None,
        key_secret: Optional[str] = None,
        webhook_secret: Optional[str] = None,
    ) -> None:
        self.key_id = key_id or getattr(settings, "RAZORPAY_KEY_ID", None)
        self.key_secret = key_secret or getattr(settings, "RAZORPAY_KEY_SECRET", None)
        self.webhook_secret = webhook_secret or getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "mock_razorpay_webhook_secret")
        self.base_url = "https://api.razorpay.com/v1"

    async def create_payout(
        self,
        account_number: str,
        ifsc_code: str,
        beneficiary_name: str,
        amount: Decimal,
        currency: str = "INR",
        mode: str = "NEFT",  # NEFT | RTGS | IMPS
        purpose: str = "vendor_payment",
        reference_id: Optional[str] = None,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute live bank transfer payout via RazorpayX.
        Amount is converted to paise (integer).
        """
        amount_paise = int(amount * 100)
        payout_ref = reference_id or f"PAYOUT-{uuid4().hex[:12].upper()}"

        if self.key_id and self.key_secret:
            try:
                auth = (self.key_id, self.key_secret)
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{self.base_url}/payouts",
                        auth=auth,
                        json={
                            "account_number": account_number,
                            "fund_account": {
                                "account_type": "bank_account",
                                "bank_account": {
                                    "name": beneficiary_name,
                                    "ifsc": ifsc_code,
                                    "account_number": account_number,
                                },
                            },
                            "amount": amount_paise,
                            "currency": currency,
                            "mode": mode.upper(),
                            "purpose": purpose,
                            "reference_id": payout_ref,
                            "narration": f"Procurement Payment {payout_ref[:8]}",
                            "notes": notes or {},
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    return {
                        "status": "PROCESSING",
                        "payout_id": data.get("id", payout_ref),
                        "reference_id": payout_ref,
                        "utr": data.get("utr"),
                        "mode": mode.upper(),
                        "amount": float(amount),
                        "currency": currency,
                        "raw_response": data,
                    }
            except Exception as exc:
                logger.error(f"Razorpay payout request failed: {exc}")
                return {
                    "status": "FAILED",
                    "payout_id": payout_ref,
                    "reference_id": payout_ref,
                    "error": str(exc),
                    "mode": mode.upper(),
                }

        # Deterministic simulation / mock execution
        utr_mock = f"CMS{uuid4().hex[:9].upper()}"
        return {
            "status": "PROCESSING",
            "payout_id": f"pout_{uuid4().hex[:14]}",
            "reference_id": payout_ref,
            "utr": utr_mock,
            "mode": mode.upper(),
            "amount": float(amount),
            "currency": currency,
            "simulated": True,
        }

    def verify_webhook_signature(
        self,
        payload_body: bytes,
        signature_header: str,
        secret: Optional[str] = None,
    ) -> bool:
        """
        Cryptographically verify Razorpay webhook signature using HMAC-SHA256.
        Header format: signature string directly from X-Razorpay-Signature.
        """
        active_secret = secret or self.webhook_secret
        if not active_secret or not signature_header:
            return False

        computed_signature = hmac.new(
            active_secret.encode("utf-8"),
            payload_body,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(computed_signature, signature_header.strip())

    @staticmethod
    def parse_webhook_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract normalized payout/payment status, reference, and UTR from webhook payload.
        """
        event = payload.get("event", "")
        entity = (
            payload.get("payload", {})
            .get("payout", {})
            .get("entity", {})
            or payload.get("payload", {})
            .get("payment", {})
            .get("entity", {})
        )

        payout_id = entity.get("id")
        reference_id = entity.get("reference_id")
        utr = entity.get("utr")
        amount = Decimal(str(entity.get("amount", 0))) / Decimal("100")
        status = entity.get("status", "")
        failure_reason = entity.get("failure_reason")

        normalized_status = "PROCESSING"
        if event in ("payout.processed", "payment.captured") or status in ("processed", "captured"):
            normalized_status = "COMPLETED"
        elif event in ("payout.reversed", "payout.failed") or status in ("reversed", "failed", "rejected"):
            normalized_status = "FAILED"

        return {
            "event": event,
            "payout_id": payout_id,
            "reference_id": reference_id,
            "utr": utr,
            "amount": amount,
            "status": normalized_status,
            "raw_status": status,
            "failure_reason": failure_reason,
        }


razorpay_adapter = RazorpayPaymentAdapter()
