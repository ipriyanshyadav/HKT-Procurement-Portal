from __future__ import annotations

from typing import Any, Optional
from uuid import UUID
import httpx
from loguru import logger

from app.config import settings


class WhatsAppChannel:
    """Enterprise WhatsApp Business dispatch channel supporting Meta Cloud API & Twilio."""

    def __init__(self) -> None:
        self.timeout = 10.0

    async def send(
        self,
        to_phone: str,
        message: str = "",
        template_code: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
        org_id: Optional[UUID] = None,
    ) -> int:
        clean_phone = to_phone.strip().replace(" ", "").replace("-", "")
        if not clean_phone.startswith("+") and not clean_phone.startswith("whatsapp:"):
            clean_phone = f"+{clean_phone}"

        provider = getattr(settings, "WHATSAPP_PROVIDER", "mock")
        enabled = getattr(settings, "WHATSAPP_ENABLED", False)

        if not enabled or provider == "mock":
            logger.info(
                "WhatsApp dispatch simulated",
                recipient=clean_phone,
                template=template_code,
                provider="mock",
                message_preview=(message or "")[:60],
            )
            return 202

        if provider == "meta":
            return await self._send_meta(clean_phone, message, template_code, context)
        elif provider == "twilio":
            return await self._send_twilio(clean_phone, message)
        else:
            logger.warning(f"Unknown WhatsApp provider: {provider}, defaulting to mock log")
            return 202

    async def _send_meta(
        self,
        to_phone: str,
        message: str,
        template_code: Optional[str],
        context: Optional[dict[str, Any]],
    ) -> int:
        phone_id = settings.WHATSAPP_PHONE_NUMBER_ID
        token = settings.WHATSAPP_ACCESS_TOKEN
        base_url = settings.WHATSAPP_API_URL

        if not phone_id or not token:
            logger.warning("Meta WhatsApp credentials missing; falling back to simulated dispatch")
            return 202

        url = f"{base_url.rstrip('/')}/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        recipient_number = to_phone.lstrip("+")
        if template_code:
            payload: dict[str, Any] = {
                "messaging_product": "whatsapp",
                "to": recipient_number,
                "type": "template",
                "template": {
                    "name": template_code.lower(),
                    "language": {"code": "en_US"},
                },
            }
            if context:
                parameters = [{"type": "text", "text": str(v)} for v in context.values()]
                payload["template"]["components"] = [
                    {"type": "body", "parameters": parameters}
                ]
        else:
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": recipient_number,
                "type": "text",
                "text": {"preview_url": False, "body": message},
            }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.is_success:
                    logger.info("WhatsApp Meta API message dispatched successfully", recipient=to_phone)
                    return resp.status_code
                logger.error(
                    "WhatsApp Meta API dispatch failed",
                    status=resp.status_code,
                    response=resp.text[:200],
                )
                return resp.status_code
        except Exception as exc:
            logger.error(f"WhatsApp Meta HTTP dispatch error: {exc}")
            return 500

    async def _send_twilio(self, to_phone: str, message: str) -> int:
        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        from_phone = settings.WHATSAPP_FROM_PHONE or "whatsapp:+14155238886"

        if not sid or not token:
            logger.warning("Twilio WhatsApp credentials missing; falling back to simulated dispatch")
            return 202

        url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
        data = {
            "From": from_phone if from_phone.startswith("whatsapp:") else f"whatsapp:{from_phone}",
            "To": to_phone if to_phone.startswith("whatsapp:") else f"whatsapp:{to_phone}",
            "Body": message,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, auth=(sid, token), data=data)
                if resp.is_success:
                    logger.info("WhatsApp Twilio message dispatched successfully", recipient=to_phone)
                    return resp.status_code
                logger.error(
                    "WhatsApp Twilio dispatch failed",
                    status=resp.status_code,
                    response=resp.text[:200],
                )
                return resp.status_code
        except Exception as exc:
            logger.error(f"WhatsApp Twilio HTTP dispatch error: {exc}")
            return 500


whatsapp_channel = WhatsAppChannel()
