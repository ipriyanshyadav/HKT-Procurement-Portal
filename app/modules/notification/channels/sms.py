from __future__ import annotations
from typing import Optional, List
from uuid import UUID
import httpx
from loguru import logger
from app.config import settings
from app.core.exceptions import ExternalServiceError

class SMSChannel:
    """MSG91 SMS dispatch channel."""

    SMS_CHAR_LIMIT = 160

    def __init__(self, api_url: Optional[str] = None, sender_id: Optional[str] = None):
        self.api_url = api_url or settings.MSG91_API_URL
        self.sender_id = sender_id or settings.MSG91_SENDER_ID or "HKTPRC"

    @classmethod
    def split_message(cls, message: str) -> List[str]:
        """Split messages longer than 160 characters into chunks."""
        if len(message) <= cls.SMS_CHAR_LIMIT:
            return [message]
        chunks = []
        for i in range(0, len(message), cls.SMS_CHAR_LIMIT):
            chunks.append(message[i:i + cls.SMS_CHAR_LIMIT])
        return chunks

    async def send(
        self,
        to_phone: str,
        message: str,
        org_id: Optional[UUID] = None,
        template_id: Optional[str] = None,
    ) -> bool:
        chunks = self.split_message(message)
        auth_key = settings.MSG91_AUTH_KEY

        if not auth_key or auth_key.startswith("test") or auth_key.startswith("mock") or auth_key == "disabled":
            logger.info(f"[SMSChannel MOCK] Sending SMS to={to_phone} parts={len(chunks)}: '{message[:50]}...'")
            return True

        for chunk in chunks:
            payload = {
                "sender": self.sender_id,
                "mobiles": to_phone.replace("+", "").strip(),
                "message": chunk,
            }
            if template_id:
                payload["template_id"] = template_id

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers={
                        "authkey": auth_key,
                        "Content-Type": "application/json",
                    },
                )

            if response.status_code not in (200, 202):
                raise ExternalServiceError("MSG91_FAILED", f"MSG91 API error: {response.status_code}")

        logger.info(f"[SMSChannel] SMS successfully sent to={to_phone}")
        return True

sms_channel = SMSChannel()
