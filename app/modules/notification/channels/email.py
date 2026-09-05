from __future__ import annotations
from typing import Optional, Any
from uuid import UUID
import httpx
from loguru import logger
from app.config import settings
from app.core.exceptions import ExternalServiceError

class EmailChannel:
    """SendGrid email dispatch channel."""

    def __init__(self, api_url: Optional[str] = None, from_email: Optional[str] = None, from_name: Optional[str] = None):
        self.api_url = api_url or settings.SENDGRID_API_URL
        self.from_email = from_email or settings.SENDGRID_FROM_EMAIL or "noreply@procurement.portal"
        self.from_name = from_name or settings.SENDGRID_FROM_NAME

    async def send(
        self,
        to_email: str,
        subject: str = "",
        body_html: str = "",
        template_code: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
        org_id: Optional[UUID] = None,
        external_template_id: Optional[str] = None,
    ) -> bool:
        context = context or {}
        subject_text = subject or f"Notification: {template_code or 'Procurement Portal'}"
        content_html = body_html or f"<p>{subject_text}</p>"

        # Allow tests or local runs with empty/dummy keys to succeed without live external network call
        api_key = settings.SENDGRID_API_KEY
        if not api_key or api_key.startswith("test") or api_key.startswith("mock") or api_key == "disabled":
            logger.info(f"[EmailChannel MOCK] Sending email to={to_email} subject='{subject_text}'")
            return True

        payload: dict[str, Any] = {
            "personalizations": [{
                "to": [{"email": to_email}],
                "dynamic_template_data": context,
            }],
            "from": {"email": self.from_email, "name": self.from_name},
            "subject": subject_text,
            "content": [{"type": "text/html", "value": content_html}],
        }
        if external_template_id:
            payload["template_id"] = external_template_id

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                self.api_url,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )

        if response.status_code not in (200, 202):
            raise ExternalServiceError("SENDGRID_FAILED", f"SendGrid API error: {response.status_code}")

        logger.info(f"[EmailChannel] Email successfully sent to={to_email}")
        return True

email_channel = EmailChannel()
