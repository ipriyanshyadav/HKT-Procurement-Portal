from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Dict, Optional

import httpx

from .http_client import SafeHTTPClient


class WebhookDeliveryService:
    """Outbound webhook delivery service with HMAC-SHA256 request signing."""

    @staticmethod
    def generate_signature(secret: str, body: bytes | str) -> str:
        """Compute HMAC-SHA256 hex digest for body with secret."""
        if isinstance(body, str):
            body_bytes = body.encode("utf-8")
        else:
            body_bytes = body
        return hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    @staticmethod
    def verify_signature(secret: str, body: bytes | str, signature_header: str) -> bool:
        """Verify HMAC-SHA256 signature in X-Procurement-Signature header."""
        if not signature_header:
            return False
        expected_sig = WebhookDeliveryService.generate_signature(secret, body)
        raw_sig = signature_header.split("sha256=")[-1].strip()
        return hmac.compare_digest(expected_sig, raw_sig)

    async def deliver(
        self,
        endpoint_url: str,
        secret: str,
        payload: Dict[str, Any],
        event_type: str,
        allowed_domains: Optional[list[str]] = None,
        timeout: float = 10.0,
    ) -> bool:
        """Deliver payload to endpoint with X-Procurement-Signature header."""
        body = json.dumps(payload, default=str).encode("utf-8")
        signature = self.generate_signature(secret, body)

        headers = {
            "Content-Type": "application/json",
            "X-Procurement-Event": event_type,
            "X-Procurement-Signature": f"sha256={signature}",
        }

        try:
            if allowed_domains:
                client = SafeHTTPClient(allowed_domains=allowed_domains, timeout=timeout)
                resp = await client.post(endpoint_url, content=body, headers=headers)
            else:
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
                    resp = await client.post(endpoint_url, content=body, headers=headers)
            return resp.status_code in (200, 201, 202)
        except Exception:
            return False


webhook_delivery_service = WebhookDeliveryService()
